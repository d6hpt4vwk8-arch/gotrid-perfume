import type { Brand, Concern, Product, ScentFamily, SkinType } from "@prisma/client";
import type { CategoryOption } from "@/lib/admin/category-options.server";

export interface ProductFormProps {
  action: (formData: FormData) => Promise<void>;
  product?: Product & {
    categories?: { categoryId: string }[];
    scentFamilies?: { scentFamilyId: string }[];
    skinTypes?: { skinTypeId: string }[];
    concerns?: { concernId: string }[];
  };
  brands: Brand[];
  categoryOptions: CategoryOption[];
  scentFamilies: ScentFamily[];
  skinTypes: SkinType[];
  concerns: Concern[];
  submitLabel: string;
}

export function ProductForm({
  action,
  product,
  brands,
  categoryOptions,
  scentFamilies,
  skinTypes,
  concerns,
  submitLabel,
}: ProductFormProps) {
  const currentCategoryId = product?.categories?.[0]?.categoryId ?? "";
  const currentScentFamilyIds = new Set(product?.scentFamilies?.map((s) => s.scentFamilyId) ?? []);
  const currentSkinTypeIds = new Set(product?.skinTypes?.map((s) => s.skinTypeId) ?? []);
  const currentConcernIds = new Set(product?.concerns?.map((c) => c.concernId) ?? []);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Název
          <input
            name="name"
            required
            defaultValue={product?.name}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Kód (code)
          <input
            name="code"
            required
            defaultValue={product?.code}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Cena (Kč)
          <input
            name="price"
            type="number"
            step="0.01"
            required
            defaultValue={product ? Number(product.price) : undefined}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Původní cena (Kč)
          <input
            name="compareAtPrice"
            type="number"
            step="0.01"
            defaultValue={product?.compareAtPrice ? Number(product.compareAtPrice) : undefined}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nákupní cena (Kč)
          <input
            name="purchasePrice"
            type="number"
            step="0.01"
            defaultValue={product ? Number(product.purchasePrice) : undefined}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Sklad (ks)
          <input
            name="stock"
            type="number"
            defaultValue={product?.stock}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          DPH (%)
          <input
            name="vatRate"
            type="number"
            defaultValue={product?.vatRate ?? 21}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          EAN
          <input
            name="ean"
            defaultValue={product?.ean ?? ""}
            className="rounded-sm border border-line px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Značka
          <select
            name="brandId"
            defaultValue={product?.brandId ?? ""}
            className="rounded-sm border border-line px-3 py-2"
          >
            <option value="">— bez značky —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Kategorie
          <select
            name="categoryId"
            defaultValue={currentCategoryId}
            className="rounded-sm border border-line px-3 py-2"
          >
            <option value="">— bez kategorie —</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {scentFamilies.length > 0 && (
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">Charakter vůně</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {scentFamilies.map((family) => (
              <label key={family.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="scentFamilyIds"
                  value={family.id}
                  defaultChecked={currentScentFamilyIds.has(family.id)}
                />
                {family.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {skinTypes.length > 0 && (
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">Typ pleti</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {skinTypes.map((skinType) => (
              <label key={skinType.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="skinTypeIds"
                  value={skinType.id}
                  defaultChecked={currentSkinTypeIds.has(skinType.id)}
                />
                {skinType.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {concerns.length > 0 && (
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">Účel</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {concerns.map((concern) => (
              <label key={concern.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="concernIds"
                  value={concern.id}
                  defaultChecked={currentConcernIds.has(concern.id)}
                />
                {concern.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Popis (HTML)
        <textarea
          name="description"
          rows={6}
          defaultValue={product?.description ?? ""}
          className="rounded-sm border border-line px-3 py-2 font-mono text-xs"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="visible" defaultChecked={product?.visible ?? true} />
        Viditelný na webu
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
