import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateCategoryContent } from "@/lib/admin/actions/categories";
import { CategoryBannerManager } from "@/components/admin/category-banner-manager";

export default async function AdminCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/kategorie" className="text-sm text-accent-2 underline">
          ← Zpět na seznam kategorií
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">{category.name}</h1>
        <p className="text-sm text-accent-2">/{category.fullSlug}</p>
      </div>

      <section className="flex flex-col gap-4 rounded-sm border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">
          Úvodní text kategorie
          <span className="ml-2 font-normal text-accent-2">
            (zobrazí se nad produkty, jen když je vyplněný)
          </span>
        </h2>

        <CategoryBannerManager categoryId={category.id} bannerImage={category.bannerImage} />

        <form action={updateCategoryContent.bind(null, category.id)} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Text (HTML — povoleno {"<p> <b> <strong> <i> <em> <u> <a href> <ul> <li> <h2> <h3>"})
            <textarea
              name="description"
              defaultValue={category.description ?? ""}
              rows={10}
              className="rounded border border-line px-2 py-1.5 font-mono text-xs"
              placeholder={`<p>Popis kategorie s odkazy na podkategorie, např. <a href="/kategorie/kosmetika/korejska-kosmetika"><b><u>korejskou kosmetiku</u></b></a>.</p>`}
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
          >
            Uložit text
          </button>
        </form>
      </section>
    </div>
  );
}
