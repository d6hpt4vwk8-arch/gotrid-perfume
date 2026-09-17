import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { setReviewPublished, deleteReview } from "@/lib/admin/actions/reviews";
import { DeleteButton } from "@/components/admin/delete-button";

// Reviews are also manageable per-product (Admin → Produkty → detail), but
// there was no single place to see what's actually waiting on approval
// across the whole catalog — a customer-submitted review defaults to
// published: false (see src/app/api/reviews/route.ts) and just sat
// invisible unless the admin happened to already be looking at that exact
// product's edit page.
export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    orderBy: [{ published: "asc" }, { date: "desc" }],
    include: { product: { select: { name: true, slug: true } } },
  });
  const pendingCount = reviews.filter((r) => !r.published).length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">
        Recenze {pendingCount > 0 && <span className="text-base font-normal text-accent-2">({pendingCount} čeká na schválení)</span>}
      </h1>

      <div className="overflow-x-auto rounded-sm border border-line bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-line bg-white text-left text-xs uppercase text-accent-2">
            <tr>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Produkt</th>
              <th className="px-3 py-2">Hodnocení</th>
              <th className="px-3 py-2">Text</th>
              <th className="px-3 py-2">Stav</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-accent-2">
                  {new Date(r.date).toLocaleDateString("cs-CZ")}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/produkty/${r.productId}`} className="underline hover:text-accent">
                    {r.product.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                  {r.authorName && <div className="text-xs text-accent-2">{r.authorName}</div>}
                </td>
                <td className="max-w-sm px-3 py-2 text-accent-2">{r.text}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {r.published ? (
                    "Zveřejněno"
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Čeká na schválení
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex items-center gap-3">
                    <form action={setReviewPublished.bind(null, r.id, !r.published)}>
                      <button type="submit" className="text-xs text-accent-2 underline hover:text-accent">
                        {r.published ? "Skrýt" : "Zveřejnit"}
                      </button>
                    </form>
                    <DeleteButton action={deleteReview.bind(null, r.id)} confirmMessage="Smazat tuto recenzi?" />
                  </div>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-accent-2">
                  Zatím žádné recenze.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
