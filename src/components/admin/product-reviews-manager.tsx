import { createReview, deleteReview, setReviewPublished } from "@/lib/admin/actions/reviews";
import { DeleteButton } from "@/components/admin/delete-button";

interface ReviewData {
  id: string;
  rating: number;
  authorName: string | null;
  text: string | null;
  date: Date;
  published: boolean;
}

export function ProductReviewsManager({
  productId,
  reviews,
}: {
  productId: string;
  reviews: ReviewData[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Recenze ({reviews.length})</span>

      {reviews.length > 0 && (
        <ul className="flex flex-col gap-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-sm border border-line p-3 text-sm"
            >
              <div>
                <div className="flex items-center font-medium">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                  {r.authorName && <span className="ml-2 font-normal text-accent-2">{r.authorName}</span>}
                  {!r.published && (
                    <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-accent-2">
                      Čeká na schválení
                    </span>
                  )}
                </div>
                {r.text && <p className="mt-1 text-accent-2">{r.text}</p>}
                <span className="text-xs text-accent-2">
                  {new Date(r.date).toLocaleDateString("cs-CZ")}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <form action={setReviewPublished.bind(null, r.id, !r.published)}>
                  <button type="submit" className="text-xs text-accent-2 underline hover:text-accent">
                    {r.published ? "Skrýt" : "Zveřejnit"}
                  </button>
                </form>
                <DeleteButton
                  action={deleteReview.bind(null, r.id)}
                  confirmMessage="Smazat tuto recenzi?"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={createReview.bind(null, productId)} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Hodnocení
          <select name="rating" defaultValue="5" className="rounded border border-line px-2 py-1">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Jméno (nepovinné)
          <input name="authorName" className="rounded border border-line px-2 py-1" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Text (nepovinný)
          <input name="text" className="rounded border border-line px-2 py-1" />
        </label>
        <button
          type="submit"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
        >
          Přidat recenzi
        </button>
      </form>
    </div>
  );
}
