-- CreateTable
CREATE TABLE "ProductScentNotes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "topNotes" JSONB NOT NULL,
    "middleNotes" JSONB NOT NULL,
    "baseNotes" JSONB NOT NULL,
    "mainAccords" JSONB,
    "source" TEXT NOT NULL DEFAULT 'fragella',
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductScentNotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductScentNotes_productId_key" ON "ProductScentNotes"("productId");

-- AddForeignKey
ALTER TABLE "ProductScentNotes" ADD CONSTRAINT "ProductScentNotes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
