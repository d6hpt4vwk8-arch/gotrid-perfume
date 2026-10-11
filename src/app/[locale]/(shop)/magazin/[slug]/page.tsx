import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { sanitizeDescription } from "@/lib/sanitize-description";
import { WhatsappAdviceButton } from "@/components/whatsapp-advice-button";

const WHATSAPP_MESSAGE_BY_CATEGORY: Record<string, string> = {
  parfemy: "Dobrý den, chtěl(a) bych poradit s výběrem parfému.",
  kosmetika: "Dobrý den, chtěl(a) bych poradit s výběrem kosmetiky.",
  obecne: "Dobrý den, mám dotaz k článku na vašem webu.",
};

async function getPost(slug: string) {
  return prisma.blogPost.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || !post.published) return {};
  return {
    title: `${post.title} | Gotrid Perfume`,
    description: post.excerpt,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  parfemy: "Parfémy",
  kosmetika: "Kosmetika",
  obecne: "Obecné",
};

const DATE_FORMAT = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric" });

function readingMinutes(text: string) {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || !post.published) notFound();

  const related = await prisma.blogPost.findMany({
    where: { published: true, slug: { not: post.slug } },
    orderBy: [{ createdAt: "desc" }],
    take: 12,
  });
  // Same category first, then newest; three cards at most.
  const readNext = [...related.filter((p) => p.category === post.category), ...related.filter((p) => p.category !== post.category)].slice(0, 3);
  const categoryLabel = CATEGORY_LABELS[post.category] ?? post.category;

  return (
    <main className="flex-1">
      <nav
        aria-label="Drobečková navigace"
        className="border-b border-line font-mono text-[11px] tracking-[0.14em] text-accent-2 uppercase"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-2 px-4 py-3">
          <Link href="/" className="hover:text-ink">Domů</Link>
          <span>/</span>
          <Link href="/magazin" className="hover:text-ink">Magazín</Link>
          <span>/</span>
          <span className="text-ink">{categoryLabel}</span>
        </div>
      </nav>

      <article className="mx-auto max-w-6xl px-4 pt-10 pb-16 md:pt-16">
        <header className="mx-auto max-w-3xl text-center">
          <p className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line pb-3 font-mono text-[11px] tracking-[0.16em] text-accent-2 uppercase">
            <span className="font-medium text-ink">{categoryLabel}</span>
            <span aria-hidden>▪</span>
            <span>{readingMinutes(post.content)} min čtení</span>
            <span aria-hidden>▪</span>
            <time dateTime={post.createdAt.toISOString()}>{DATE_FORMAT.format(post.createdAt)}</time>
          </p>
          <h1 className="mt-7 text-3xl leading-[1.1] font-medium tracking-tight text-ink text-balance md:text-5xl">
            {post.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-accent text-pretty md:text-xl">
            {post.excerpt}
          </p>
        </header>

        {post.coverImage && (
          <div className="relative mt-10 aspect-[16/9] w-full overflow-hidden bg-line/60 md:mt-14 md:aspect-[21/9]">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <div
          className="article-body mx-auto mt-10 max-w-[680px] md:mt-14"
          dangerouslySetInnerHTML={{ __html: sanitizeDescription(post.contentHtml) }}
        />

        <aside className="mx-auto mt-14 flex max-w-3xl flex-col items-start gap-5 bg-ink px-6 py-9 text-white md:mt-20 md:px-10 md:py-12">
          <p className="font-mono text-[11px] tracking-[0.18em] text-white/60 uppercase">Poradíme osobně</p>
          <p className="text-xl leading-snug font-medium md:text-2xl">
            Nevíte si rady s výběrem? Napište nám a vybereme spolu.
          </p>
          <WhatsappAdviceButton
            message={WHATSAPP_MESSAGE_BY_CATEGORY[post.category] ?? WHATSAPP_MESSAGE_BY_CATEGORY.obecne}
            label="Poradit na WhatsAppu"
          />
        </aside>

        {readNext.length > 0 && (
          <section className="mt-16 border-t border-line pt-8 md:mt-24">
            <h2 className="font-mono text-[11px] tracking-[0.18em] text-accent-2 uppercase">Čtěte také</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {readNext.map((p) => (
                <Link key={p.slug} href={`/magazin/${p.slug}`} className="group flex flex-col gap-3">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-line/60">
                    {p.coverImage ? (
                      <Image
                        src={p.coverImage}
                        alt={p.title}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-accent-2">Gotrid Perfume</div>
                    )}
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.16em] text-accent-2 uppercase">
                    {CATEGORY_LABELS[p.category] ?? p.category}
                  </span>
                  <span className="text-lg leading-snug font-medium text-ink group-hover:underline">{p.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
