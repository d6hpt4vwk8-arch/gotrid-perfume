-- CreateTable
CREATE TABLE "SkinType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "SkinType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSkinType" (
    "productId" TEXT NOT NULL,
    "skinTypeId" TEXT NOT NULL,

    CONSTRAINT "ProductSkinType_pkey" PRIMARY KEY ("productId","skinTypeId")
);

-- CreateTable
CREATE TABLE "Concern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Concern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductConcern" (
    "productId" TEXT NOT NULL,
    "concernId" TEXT NOT NULL,

    CONSTRAINT "ProductConcern_pkey" PRIMARY KEY ("productId","concernId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkinType_slug_key" ON "SkinType"("slug");

-- CreateIndex
CREATE INDEX "ProductSkinType_skinTypeId_idx" ON "ProductSkinType"("skinTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Concern_slug_key" ON "Concern"("slug");

-- CreateIndex
CREATE INDEX "ProductConcern_concernId_idx" ON "ProductConcern"("concernId");

-- AddForeignKey
ALTER TABLE "ProductSkinType" ADD CONSTRAINT "ProductSkinType_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSkinType" ADD CONSTRAINT "ProductSkinType_skinTypeId_fkey" FOREIGN KEY ("skinTypeId") REFERENCES "SkinType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConcern" ADD CONSTRAINT "ProductConcern_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConcern" ADD CONSTRAINT "ProductConcern_concernId_fkey" FOREIGN KEY ("concernId") REFERENCES "Concern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
