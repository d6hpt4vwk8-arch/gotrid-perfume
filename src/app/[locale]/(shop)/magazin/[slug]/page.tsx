import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LegalPage } from "@/components/legal-page";
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
      <div
        className="[&_a]:underline [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-ink [&_li]:mb-1 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: sanitizeDescription(post.contentHtml) }}
      />

      <div className="not-prose mt-2">
        <WhatsappAdviceButton
          message={WHATSAPP_MESSAGE_BY_CATEGORY[post.category] ?? WHATSAPP_MESSAGE_BY_CATEGORY.obecne}
          label="Poradit na WhatsAppu"
        />
      </div>
    </LegalPage>
  );
}
