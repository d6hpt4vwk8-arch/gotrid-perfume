-- Carrier cost for Slovak parcels (nullable: unset falls back to the CZ cost) — net-profit figures only.
ALTER TABLE "Settings" ADD COLUMN "shippingCostZasilkovnaSk" DECIMAL(10,2);
ALTER TABLE "Settings" ADD COLUMN "shippingCostGlsSk" DECIMAL(10,2);
ALTER TABLE "Settings" ADD COLUMN "shippingCostGlsMistoSk" DECIMAL(10,2);
