import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCategoryOptions } from "@/lib/admin/category-options.server";
import { updateProduct, deleteProduct } from "@/lib/admin/actions/products";
import { ProductForm } from "@/components/admin/product-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { ProductImagesManager } from "@/components/admin/product-images-manager";
import { ProductReviewsManager } from "@/components/admin/product-reviews-manager";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, brands, categoryOptions, scentFamilies, skinTypes, concerns] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        categories: true,
        scentFamilies: true,
        skinTypes: true,
        concerns: true,
        images: { orderBy: { sortOrder: "asc" } },
        reviews: { orderBy: { date: "desc" } },
      },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    getCategoryOptions(),
    prisma.scentFamily.findMany({ orderBy: { name: "asc" } }),
    prisma.skinType.findMany({ orderBy: { name: "asc" } }),
    prisma.concern.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{product.name}</h1>
        <DeleteButton
          action={deleteProduct.bind(null, id)}
          confirmMessage={`Opravdu smazat produkt "${product.name}"? Tuto akci nelze vrátit zpět.`}
        />
      </div>
      <ProductImagesManager productId={id} images={product.images} />
      <ProductReviewsManager productId={id} reviews={product.reviews} />
      <ProductForm
        action={updateProduct.bind(null, id)}
        product={product}
        brands={brands}
        categoryOptions={categoryOptions}
        scentFamilies={scentFamilies}
        skinTypes={skinTypes}
        concerns={concerns}
        submitLabel="Uložit změny"
      />
    </div>
  );
}
