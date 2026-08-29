import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LegalPage } from "@/components/legal-page";
import { sanitizeDescription } from "@/lib/sanitize-description";

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

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || !post.published) notFound();

  return (
    <LegalPage title={post.title}>
      {post.coverImage && (
        <div className="not-prose relative mb-2 aspect-[16/9] w-full overflow-hidden rounded-sm bg-line/60">
          <Image src={post.coverImage} alt={post.title} fill sizes="768px" className="object-cover" />
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: sanitizeDescription(post.contentHtml) }} />
    </LegalPage>
  );
}
