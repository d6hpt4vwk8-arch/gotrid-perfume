-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "packetaId" TEXT,
ADD COLUMN     "weight" DECIMAL(10,3) NOT NULL DEFAULT 0.5;
