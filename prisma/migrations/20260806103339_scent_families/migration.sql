-- CreateTable
CREATE TABLE "ScentFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ScentFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductScentFamily" (
    "productId" TEXT NOT NULL,
    "scentFamilyId" TEXT NOT NULL,

    CONSTRAINT "ProductScentFamily_pkey" PRIMARY KEY ("productId","scentFamilyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScentFamily_slug_key" ON "ScentFamily"("slug");

-- CreateIndex
CREATE INDEX "ProductScentFamily_scentFamilyId_idx" ON "ProductScentFamily"("scentFamilyId");

-- AddForeignKey
ALTER TABLE "ProductScentFamily" ADD CONSTRAINT "ProductScentFamily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductScentFamily" ADD CONSTRAINT "ProductScentFamily_scentFamilyId_fkey" FOREIGN KEY ("scentFamilyId") REFERENCES "ScentFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
