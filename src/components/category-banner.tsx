import Image from "next/image";
import Link from "next/link";
import type { CategoryBannerTile } from "@/lib/category-banner.server";

function productsLabel(n: number) {
  if (n === 1) return "1 produkt";
  if (n >= 2 && n <= 4) return `${n} produkty`;
  return `${n} produktů`;
}

export function CategoryBanner({
  name,
  total,
  tiles,
}: {
  name: string;
  total: number;
  tiles: CategoryBannerTile[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-ink text-white">
      <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8">
        <div className="shrink-0 lg:w-56">
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-white/60">
            {productsLabel(total)} skladem · {tiles.length} podkategorií
          </p>
        </div>

        <ul className="flex w-0 min-w-full gap-3 overflow-x-auto pb-1 lg:min-w-0 lg:flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tiles.map((tile) => (
            <li key={tile.id} className="w-28 shrink-0 sm:w-32 lg:w-auto lg:max-w-44 lg:min-w-28 lg:flex-1">
              <Link href={`/kategorie/${tile.fullSlug}`} className="group flex flex-col gap-2">
                <span className="relative flex aspect-[4/3] items-center justify-center gap-0.5 overflow-hidden rounded-xl bg-white px-1.5 ring-1 ring-white/10 transition group-hover:ring-white/50">
                  {tile.images.map((img) => (
                    <span key={img.url} className="relative h-[85%] flex-1">
                      <Image
                        src={img.url}
                        alt={img.alt}
                        fill
                        sizes="96px"
                        className="object-contain mix-blend-multiply"
                      />
                    </span>
                  ))}
                </span>
                <span className="text-xs font-medium leading-tight text-white group-hover:underline">
                  {tile.name}
                  <span className="block font-normal text-white/50">{tile.count}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
