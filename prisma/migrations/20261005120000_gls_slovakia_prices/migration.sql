-- Cross-border GLS prices for Slovakia (nullable: unset falls back to the CZ price).
ALTER TABLE "Settings" ADD COLUMN "shippingPriceGlsSk" DECIMAL(10,2);
ALTER TABLE "Settings" ADD COLUMN "shippingPriceGlsMistoSk" DECIMAL(10,2);
