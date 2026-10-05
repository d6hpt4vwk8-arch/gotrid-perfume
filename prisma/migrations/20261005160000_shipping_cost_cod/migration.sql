-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "shippingCostCod" DECIMAL(10,2) NOT NULL DEFAULT 25.41;
-- Real Zásilkovna parcel cost incl. 21 % VAT (invoice 6010661879: 86,42 net -> 104,57)
UPDATE "Settings" SET "shippingCostZasilkovna" = 104.57 WHERE id = 'singleton';
