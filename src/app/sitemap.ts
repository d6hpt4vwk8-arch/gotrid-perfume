import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, brands] = await Promise.all([
    prisma.category.findMany({ where: { hidden: false }, select: { fullSlug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { visible: true }, select: { slug: true, updatedAt: true } }),
    prisma.brand.findMany({ select: { slug: true, updatedAt: true } }),
  ]);

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: `${SITE_URL}/kategorie/${c.fullSlug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${SITE_URL}/produkt/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...brands.map((b) => ({
      url: `${SITE_URL}/znacka/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
