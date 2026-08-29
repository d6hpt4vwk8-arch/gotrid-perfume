import { createBlogPost } from "@/lib/admin/actions/blog-posts";
import { BlogPostForm } from "@/components/admin/blog-post-form";

export default function NewBlogPostPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Nový článek</h1>
      <BlogPostForm action={createBlogPost} submitLabel="Vytvořit článek" />
    </div>
  );
}
