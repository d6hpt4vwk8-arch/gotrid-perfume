import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

// Hand-picked showcase products for the homepage hero — one arabský parfém
// plus two korejské péče items, matching the two curated sections below the
// fold. Slugs (not IDs) so the pick survives a catalog re-import; anything
// that goes missing or invisible is simply dropped from the row.
const HERO_PRODUCT_SLUGS = [
  // Was a Romscent (ROM-) product — swapped 2026-09-02 when Romscent was
  // paused (visible:false), which silently dropped this slot to 2 items.
  "lattafa-fakhar-lattafa-eau-de-parfum-100-ml--unisex",
  "dr-althea-aqua-marine-deep-serum-gvs-256191",
  "cp-1-bright-complex-intense-nourishing-shampoo-version-2-0-100-ml-gvs-12104",
];

export async function HomeHero() {
  const products = await prisma.product.findMany({
    where: { slug: { in: HERO_PRODUCT_SLUGS }, visible: true },
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const featured = HERO_PRODUCT_SLUGS.map((slug) => products.find((p) => p.slug === slug)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );

  return (
    <section
      className="relative overflow-hidden rounded-sm px-6 py-12 text-white sm:px-10 sm:py-14"
      style={{
        background:
          "radial-gradient(ellipse 70% 80% at 18% 15%, rgba(255,255,255,.10), transparent 62%)," +
          "linear-gradient(160deg, #2a2725, #131110 75%)",
      }}
    >
      <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-14">
        <div className="flex flex-col items-start gap-5 lg:w-[45%]">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] tracking-widest uppercase sm:text-[11px]">
            100 % originální, přímo od distributorů
          </span>
          <h1 className="text-3xl leading-[1.15] font-bold sm:text-4xl lg:text-[2.6rem]">
            Arabské parfémy a korejská kosmetika za poctivou cenu.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Pečlivě vybrané parfémy a korejská péče, které v běžném e-shopu nenajdete — dovážíme
            přímo od distributorů a ověřujeme původ každého kusu.
          </p>
          <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href="/kategorie/parfemy/arabske-parfemy"
              className="rounded-sm bg-white px-5 py-3 text-center text-sm font-semibold text-ink transition hover:bg-white/85"
            >
              Arabské parfémy
            </Link>
            <Link
              href="/kategorie/kosmetika"
              className="rounded-sm border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              Korejská kosmetika
            </Link>
          </div>
        </div>

        {featured.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:flex-1">
            {featured.map((product, i) => (
              <Link
                key={product.slug}
                href={`/produkt/${product.slug}`}
                className={`group flex flex-col overflow-hidden rounded-sm bg-white/95 transition hover:bg-white ${
                  i === 1 ? "lg:-translate-y-6" : ""
                }`}
              >
                <div className="relative aspect-square w-full">
                  {product.images[0] ? (
                    <Image
                      src={product.images[0].url}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1024px) 18vw, 30vw"
                      className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-accent-2">
                      Bez obrázku
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 border-t border-line/70 px-3 py-2.5">
                  {product.brand && (
                    <span className="text-[9px] font-medium tracking-wide text-accent-2 uppercase">
                      {product.brand.name}
                    </span>
                  )}
                  <span className="line-clamp-2 text-[11px] leading-snug font-semibold text-ink sm:text-xs">
                    {product.name}
                  </span>
                  <span className="text-sm font-bold text-ink">{formatPrice(product.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
