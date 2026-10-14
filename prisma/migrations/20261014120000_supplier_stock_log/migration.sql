-- CreateTable
CREATE TABLE "SupplierStockLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierStock" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierStockLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierStockLog_productId_createdAt_idx" ON "SupplierStockLog"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierStockLog_createdAt_idx" ON "SupplierStockLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SupplierStockLog" ADD CONSTRAINT "SupplierStockLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
