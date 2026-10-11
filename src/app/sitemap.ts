import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SEO_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, brands, posts] = await Promise.all([
    prisma.category.findMany({ where: { hidden: false }, select: { fullSlug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { visible: true }, select: { slug: true, updatedAt: true } }),
    // Brand pages without an in-stock product are noindex (see znacka/[slug]), so keep them out of the sitemap too.
    prisma.brand.findMany({
      where: { products: { some: { visible: true, stock: { gt: 0 } } } },
      select: { slug: true, updatedAt: true },
    }),
    prisma.blogPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);

  // Indexable informational pages (all return 200 without a noindex tag) —
  // they were missing from the sitemap, so Seznam/Google only found them by links.
  const staticPages = [
    "magazin",
    "znacky",
    "o-nas",
    "kontakty",
    "doprava-a-platba",
    "obchodni-podminky",
    "podminky-vraceni-zbozi",
    "garance-originality-produktu",
    "podminky-ochrany-osobnich-udaju",
  ];

  return [
    { url: SEO_URL, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: `${SEO_URL}/kategorie/${c.fullSlug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${SEO_URL}/produkt/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...staticPages.map((slug) => ({
      url: `${SEO_URL}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...posts.map((a) => ({
      url: `${SEO_URL}/magazin/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...brands.map((b) => ({
      url: `${SEO_URL}/znacka/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
