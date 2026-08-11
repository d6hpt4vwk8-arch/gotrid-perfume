ALTER TABLE "Product" ADD COLUMN "variantGroupKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "isPrimaryVariant" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Product_variantGroupKey_idx" ON "Product"("variantGroupKey");
