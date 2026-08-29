import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateBlogPost, deleteBlogPost } from "@/lib/admin/actions/blog-posts";
import { BlogPostForm } from "@/components/admin/blog-post-form";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{post.title}</h1>
        <DeleteButton
          action={deleteBlogPost.bind(null, id)}
          confirmMessage={`Opravdu smazat článek "${post.title}"?`}
        />
      </div>
      <BlogPostForm action={updateBlogPost.bind(null, id)} post={post} submitLabel="Uložit změny" />
    </div>
  );
}
