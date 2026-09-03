ALTER TABLE "Order" ADD COLUMN     "glsParcelId" INTEGER;
ALTER TABLE "Order" ADD COLUMN     "glsParcelNumber" TEXT;
ALTER TABLE "Settings" ADD COLUMN     "shippingPriceGls" DECIMAL(10,2) NOT NULL DEFAULT 99;
