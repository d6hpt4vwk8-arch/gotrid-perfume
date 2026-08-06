import { prisma } from "@/lib/prisma";
import { getCategoryOptions } from "@/lib/admin/category-options.server";
import { createProduct } from "@/lib/admin/actions/products";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const [brands, categoryOptions, scentFamilies, skinTypes, concerns] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    getCategoryOptions(),
    prisma.scentFamily.findMany({ orderBy: { name: "asc" } }),
    prisma.skinType.findMany({ orderBy: { name: "asc" } }),
    prisma.concern.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Nový produkt</h1>
      <ProductForm
        action={createProduct}
        brands={brands}
        categoryOptions={categoryOptions}
        scentFamilies={scentFamilies}
        skinTypes={skinTypes}
        concerns={concerns}
        submitLabel="Vytvořit produkt"
      />
    </div>
  );
}
