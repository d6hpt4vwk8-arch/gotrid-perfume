import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// Google (and other search engines) still list product pages under the old flat
// "/<slug>" address from before the "/produkt/" prefix, and those URLs 404
// (found 2026-10-11: the Air Wick refill ranked as gotridperfume.cz/air-wick-…
// and clicking it landed on a 404). The static list in product-redirects.json
// only covers the original Shoptet catalogue, so any other product slug that
// reaches this catch-all is sent to its real address with a 301. Every static
// route (kategorie, produkt, kosik, …) is matched before this one, so nothing
// real is ever swallowed; an unknown slug still ends in the normal 404.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LegacyProductRedirect({
  params,
}: {
  params: Promise<{ legacySlug: string }>;
}) {
  const { legacySlug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug: legacySlug },
    select: { slug: true },
  });
  if (!product) notFound();
  permanentRedirect(`/produkt/${product.slug}`);
}
