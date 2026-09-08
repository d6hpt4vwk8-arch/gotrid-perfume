import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Značky | Gotrid Perfume",
  description: "Přehled všech značek parfémů, kosmetiky a drogerie, které nabízíme.",
};

export default async function BrandsIndexPage() {
  // Only brands that actually have something to show for — a brand with no
  // visible, in-stock product would just be a dead-end badge.
  const brands = await prisma.brand.findMany({
    where: { products: { some: { visible: true, stock: { gt: 0 } } } },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });

  const groups = new Map<string, typeof brands>();
  for (const brand of brands) {
    const letter = /^[a-z]/i.test(brand.name) ? brand.name[0]!.toUpperCase() : "#";
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(brand);
  }
  const letters = [...groups.keys()].sort();

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-ink">Značky</h1>
        <p className="mt-1 text-sm text-accent-2">{brands.length} značek, které aktuálně nabízíme.</p>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-line pb-6 text-sm" aria-label="Přejít na písmeno">
        {letters.map((letter) => (
          <a
            key={letter}
            href={`#pismeno-${letter}`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink hover:border-accent hover:text-accent"
          >
            {letter}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-8">
        {letters.map((letter) => (
          <section key={letter} id={`pismeno-${letter}`} className="scroll-mt-24">
            <h2 className="mb-3 text-lg font-semibold text-ink">{letter}</h2>
            <div className="flex flex-wrap gap-2">
              {groups.get(letter)!.map((brand) => (
                <Link
                  key={brand.slug}
                  href={`/znacka/${brand.slug}`}
                  className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
