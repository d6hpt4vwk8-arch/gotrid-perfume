import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Magazín | Gotrid Perfume",
  description: "Rady s výběrem parfémů a kosmetiky, novinky a příběhy značek, které máme rádi.",
};

const CATEGORY_LABELS: Record<string, string> = {
  parfemy: "Parfémy",
  kosmetika: "Kosmetika",
  obecne: "Obecné",
};

export default async function MagazinPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const posts = await prisma.blogPost.findMany({
    where: { published: true, ...(category ? { category } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Magazín</h1>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/magazin"
          className={`rounded-full border px-3 py-1 text-sm ${
            !category ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-accent"
          }`}
        >
          Vše
        </Link>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/magazin?category=${value}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === value ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-accent"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-accent-2">Zatím tu nic není, brzy přidáme první články.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/magazin/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-sm border border-line"
            >
              <div className="relative aspect-[16/10] w-full bg-line/60">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-accent-2">
                    Gotrid Perfume
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <span className="text-[10px] font-medium tracking-wide text-accent-2 uppercase">
                  {CATEGORY_LABELS[post.category] ?? post.category}
                </span>
                <span className="font-semibold text-ink group-hover:underline">{post.title}</span>
                <span className="line-clamp-2 text-sm text-ink/70">{post.excerpt}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
