-- "Nakupuji na firmu" checkout option: buyer company identity for invoicing.
ALTER TABLE "Order" ADD COLUMN "companyName" TEXT;
ALTER TABLE "Order" ADD COLUMN "ico" TEXT;
ALTER TABLE "Order" ADD COLUMN "dic" TEXT;
