-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "accessToken" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "freeShippingThreshold" DECIMAL(10,2) NOT NULL DEFAULT 1500,
    "shippingPriceZasilkovna" DECIMAL(10,2) NOT NULL DEFAULT 79,
    "shippingPricePpl" DECIMAL(10,2) NOT NULL DEFAULT 90,
    "shippingPriceDpd" DECIMAL(10,2) NOT NULL DEFAULT 99,
    "shippingPriceBalikovna" DECIMAL(10,2) NOT NULL DEFAULT 69,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "RateLimitHit"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");

