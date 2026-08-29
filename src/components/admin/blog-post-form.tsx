import type { BlogPost } from "@prisma/client";

const CATEGORY_OPTIONS = [
  { value: "parfemy", label: "Parfémy" },
  { value: "kosmetika", label: "Kosmetika" },
  { value: "obecne", label: "Obecné" },
];

export function BlogPostForm({
  action,
  post,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  post?: BlogPost;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Nadpis
        <input
          name="title"
          required
          defaultValue={post?.title}
          className="rounded-sm border border-line px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Slug (URL) — nechte prázdné pro automatické vygenerování z nadpisu
        <input
          name="slug"
          defaultValue={post?.slug}
          placeholder="jak-vybrat-parfem"
          className="rounded-sm border border-line px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Perex (krátký úvod, zobrazí se v seznamu článků)
        <textarea
          name="excerpt"
          required
          rows={2}
          defaultValue={post?.excerpt}
          className="rounded-sm border border-line px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Kategorie
          <select
            name="category"
            defaultValue={post?.category ?? "obecne"}
            className="rounded-sm border border-line px-3 py-2"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Obrázek (URL, nepovinné)
          <input
            name="coverImage"
            defaultValue={post?.coverImage ?? ""}
            placeholder="https://..."
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Obsah — prázdný řádek = nový odstavec
        <textarea
          name="content"
          required
          rows={14}
          defaultValue={post?.content}
          className="rounded-sm border border-line px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={post?.published ?? true} />
        Zveřejněno (viditelné na webu)
      </label>

      <button
        type="submit"
        className="w-fit rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-accent"
      >
        {submitLabel}
      </button>
    </form>
  );
}
