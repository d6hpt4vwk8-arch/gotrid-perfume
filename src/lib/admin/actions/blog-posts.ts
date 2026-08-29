"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdmin } from "@/lib/admin/require-admin";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const blogPostSchema = z.object({
  title: z.string().trim().min(1, "Nadpis je povinný.").max(200),
  slug: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  excerpt: z.string().trim().min(1, "Perex je povinný.").max(500),
  category: z.enum(["parfemy", "kosmetika", "obecne"]),
  coverImage: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
  content: z.string().trim().min(1, "Obsah je povinný.").max(50_000),
  published: z.coerce.boolean().default(false),
});

// Authors write plain text in the textarea (blank line = new paragraph) —
// escape it and wrap each block in <p>, then sanitizeDescription() at render
// time is the real security boundary (same as product descriptions).
function textToParagraphHtml(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function parseBlogPostForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = blogPostSchema.safeParse({ ...raw, published: formData.get("published") === "on" });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data článku.");
  }
  return parsed.data;
}

export async function createBlogPost(formData: FormData) {
  await requireAdmin();
  const data = parseBlogPostForm(formData);
  const slug = slugify(data.slug || data.title);
  if (!slug) throw new Error("Nepodařilo se vygenerovat slug z nadpisu.");

  const post = await prisma.blogPost.create({
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt,
      category: data.category,
      coverImage: data.coverImage,
      content: data.content,
      contentHtml: textToParagraphHtml(data.content),
      published: data.published,
    },
  });
  await logAdminActivity({
    action: "blog_post.create",
    entityType: "BlogPost",
    entityId: post.id,
    detail: `Vytvořen článek „${post.title}“`,
  });

  revalidatePath("/admin/magazin");
  revalidatePath("/magazin");
  redirect(`/admin/magazin/${post.id}`);
}

export async function updateBlogPost(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseBlogPostForm(formData);
  const slug = slugify(data.slug || data.title);
  if (!slug) throw new Error("Nepodařilo se vygenerovat slug z nadpisu.");

  const post = await prisma.blogPost.update({
    where: { id },
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt,
      category: data.category,
      coverImage: data.coverImage,
      content: data.content,
      contentHtml: textToParagraphHtml(data.content),
      published: data.published,
    },
  });
  await logAdminActivity({
    action: "blog_post.update",
    entityType: "BlogPost",
    entityId: id,
    detail: `Upraven článek „${post.title}“`,
  });

  revalidatePath("/admin/magazin");
  revalidatePath(`/admin/magazin/${id}`);
  revalidatePath("/magazin");
  revalidatePath(`/magazin/${slug}`);
}

export async function deleteBlogPost(id: string) {
  await requireAdmin();
  const post = await prisma.blogPost.delete({ where: { id } });
  await logAdminActivity({
    action: "blog_post.delete",
    entityType: "BlogPost",
    entityId: id,
    detail: `Smazán článek „${post.title}“`,
  });
  revalidatePath("/admin/magazin");
  revalidatePath("/magazin");
  redirect("/admin/magazin");
}
