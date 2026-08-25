import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCategoryNavTree } from "@/lib/categories.server";
import { primaryVariantWhere } from "@/lib/product-filters";
import { ProductCard } from "@/components/product-card";
import { getHeurekaShopReviews } from "@/lib/heureka-reviews";

// K-beauty brands carried in the catalog — used to curate the homepage's
// "Korejská kosmetika" section (no dedicated category exists for this yet).
const KOREAN_COSMETICS_BRANDS = [
  "Cosrx", "Esthetic House", "Dr. Althea", "Missha", "SKIN1004", "Beauty Of Joseon",
  "VT Cosmetics", "VVBETTER", "APLB", "Medicube", "Some By Mi", "Haruharu Wonder",
  "Dr.Jart+", "Round Lab", "Celimax", "Lavon", "Holika Holika", "ITOXX", "Biodance",
  "Pyunkang Yul", "AXIS-Y", "Purito", "Abib", "Medi-Peel", "Mixsoon", "Numbuzin",
  "TIRTIR", "K-SECRET", "Isntree", "Polatam", "Dear, Klairs", "Coxir", "Barulab",
  "DAENG GI MEO RI", "Frudia", "Inkee", "Banila Co", "rom&nd", "TOCOBO", "Laneige",
  "Naturia", "d'Alba", "MEDIPEEL+", "Hyggee", "Torriden", "MEDIBLANC", "Hanskin",
  "Sioris", "I’m From",
];

export default async function HomePage() {
  const [categories, saleProducts, koreanCosmetics, arabicPerfumes, latestReviews] =
    await Promise.all([
      getCategoryNavTree(),
      prisma.product.findMany({
        where: { visible: true, ...primaryVariantWhere, compareAtPrice: { not: null } },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 12,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
      prisma.product.findMany({
        where: {
          visible: true,
          ...primaryVariantWhere,
          brand: { name: { in: KOREAN_COSMETICS_BRANDS } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 12,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
      prisma.product.findMany({
        where: {
          visible: true,
          ...primaryVariantWhere,
          categories: { some: { category: { fullSlug: "parfemy/arabske-parfemy" } } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 12,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
      getHeurekaShopReviews(6),
    ]);

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-12 px-4 py-10">
      <section
        className="flex flex-col items-center gap-4 rounded-sm px-8 py-20 text-center text-white"
        style={{
          background:
            "linear-gradient(180deg, rgba(19,17,16,0) 0%, rgba(19,17,16,.55) 100%)," +
            "radial-gradient(ellipse 65% 70% at 50% 35%, rgba(255,255,255,.08), transparent 65%)," +
            "linear-gradient(160deg, #2a2725, #131110 75%)",
        }}
      >
        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] tracking-widest text-white uppercase">
          100 % originální, přímo od distributorů
        </span>
        <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
          Poctivá cena, bez maloobchodní přirážky.
        </h1>
        <p className="max-w-md text-sm text-white/70">
          Značková parfumerie a kosmetika s doručením po celé ČR. Doprava zdarma od 1 500 Kč.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Kategorie</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categories
            .filter((c) => !c.hidden)
            .map((category) => (
              <Link
                key={category.id}
                href={`/kategorie/${category.fullSlug}`}
                className="rounded-lg border border-neutral-200 px-4 py-6 text-center text-sm font-medium hover:border-neutral-400"
              >
                {category.name}
              </Link>
            ))}
        </div>
      </section>

      {koreanCosmetics.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Korejská kosmetika</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {koreanCosmetics.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </section>
      )}

      {arabicPerfumes.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Arabské parfémy</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {arabicPerfumes.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </section>
      )}

      {saleProducts.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Výprodej</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {saleProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </section>
      )}

      {latestReviews.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Poslední recenze</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {latestReviews.map((review) => (
              <div
                key={review.id}
                className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 text-sm"
              >
                <span className="font-medium">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
                <p className="text-neutral-600 line-clamp-3">{review.text}</p>
                <span className="text-xs text-neutral-400">Ověřeno zákazníky — Heureka.cz</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
