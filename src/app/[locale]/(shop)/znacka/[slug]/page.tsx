import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { primaryVariantWhere } from "@/lib/product-filters";
import { ProductCard } from "@/components/product-card";

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) notFound();

  const products = await prisma.product.findMany({
    where: { visible: true, brandId: brand.id, ...primaryVariantWhere, stock: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">{brand.name}</h1>

      {products.length === 0 ? (
        <p className="text-sm text-accent-2">U této značky zatím nejsou žádné produkty.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
