-- AlterTable
ALTER TABLE "Order" ADD COLUMN "comgateTransId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_comgateTransId_key" ON "Order"("comgateTransId");
