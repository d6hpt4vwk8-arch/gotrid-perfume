import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminBlogPostsPage() {
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Magazín ({posts.length})</h1>
        <Link
          href="/admin/magazin/novy"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
        >
          Nový článek
        </Link>
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Nadpis</th>
              <th className="px-3 py-2">Kategorie</th>
              <th className="px-3 py-2">Stav</th>
              <th className="px-3 py-2">Vytvořeno</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/admin/magazin/${post.id}`} className="font-medium text-ink hover:underline">
                    {post.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-accent-2">{post.category}</td>
                <td className="px-3 py-2">
                  {post.published ? (
                    <span className="text-ok">Zveřejněno</span>
                  ) : (
                    <span className="text-accent-2">Koncept</span>
                  )}
                </td>
                <td className="px-3 py-2 text-accent-2">
                  {post.createdAt.toLocaleDateString("cs-CZ")}
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-accent-2">
                  Zatím žádné články.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
