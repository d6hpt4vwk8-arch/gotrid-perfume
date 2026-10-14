import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SEO_URL } from "@/lib/site";

// Every storefront URL exists in Czech (default, no prefix) and Slovak
// (/sk/...); each entry lists both as hreflang alternates so Google/Seznam
// treat them as one page in two languages.
function entry(
  path: string,
  extra: { lastModified?: Date; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number },
): MetadataRoute.Sitemap[number] {
  const cs = `${SEO_URL}${path}`;
  const sk = `${SEO_URL}/sk${path}`;
  return { url: cs, ...extra, alternates: { languages: { cs, sk, "x-default": cs } } };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, brands, posts] = await Promise.all([
    prisma.category.findMany({ where: { hidden: false }, select: { fullSlug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { visible: true }, select: { slug: true, updatedAt: true, nameSk: true } }),
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
    entry("", { changeFrequency: "daily", priority: 1 }),
    ...categories.map((c) =>
      entry(`/kategorie/${c.fullSlug}`, { lastModified: c.updatedAt, changeFrequency: "daily", priority: 0.7 }),
    ),
    ...products.map((p) =>
      p.nameSk
        ? entry(`/produkt/${p.slug}`, { lastModified: p.updatedAt, changeFrequency: "daily", priority: 0.8 })
        : // Not translated yet: Czech page only, no Slovak alternate.
          { url: `${SEO_URL}/produkt/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.8 },
    ),
    ...staticPages.map((slug) => entry(`/${slug}`, { changeFrequency: "monthly", priority: 0.4 })),
    // The magazine is Czech-only — no Slovak alternate.
    { url: `${SEO_URL}/magazin`, changeFrequency: "monthly" as const, priority: 0.4 },
    ...posts.map((a) => ({
      url: `${SEO_URL}/magazin/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...brands.map((b) =>
      entry(`/znacka/${b.slug}`, { lastModified: b.updatedAt, changeFrequency: "weekly", priority: 0.5 }),
    ),
  ];
}
