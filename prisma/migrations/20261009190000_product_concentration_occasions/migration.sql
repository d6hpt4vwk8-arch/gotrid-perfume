-- AlterTable
ALTER TABLE "Product" ADD COLUMN "concentration" TEXT,
ADD COLUMN "occasions" TEXT[] DEFAULT ARRAY[]::TEXT[];
