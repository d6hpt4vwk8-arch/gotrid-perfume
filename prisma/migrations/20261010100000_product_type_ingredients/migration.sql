-- AlterTable
ALTER TABLE "Product" ADD COLUMN "productType" TEXT,
ADD COLUMN "keyIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[];
