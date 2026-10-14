import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { SK_ONLY_WHERE } from "@/lib/sk-visibility";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tr = await getTr();
  return {
    title: `${tr("Značky")} | Gotrid Perfume`,
    description: tr("Přehled všech značek parfémů, kosmetiky a drogerie, které nabízíme."),
    alternates: localeAlternates(locale, "/znacky"),
  };
}

export default async function BrandsIndexPage() {
  const tr = await getTr();
  const isSk = (await getCurrentLocale()) === "sk";
  // Only brands that actually have something to show for — a brand with no
  // visible, in-stock product would just be a dead-end badge.
  const brands = await prisma.brand.findMany({
    where: { products: { some: { visible: true, stock: { gt: 0 }, ...(isSk ? SK_ONLY_WHERE : {}) } } },
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
        <h1 className="text-2xl font-bold text-ink">{tr("Značky")}</h1>
        <p className="mt-1 text-sm text-accent-2">{tr("{n} značek, které aktuálně nabízíme.", { n: brands.length })}</p>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-line pb-6 text-sm" aria-label={tr("Přejít na písmeno")}>
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
