-- AlterTable
-- Card-gateway (Comgate) fee used only in the net-profit figures: percent of the order total + a fixed amount per
-- transaction, both ex-VAT (VAT is added for a non-VAT-payer seller). Defaults = the standard "Profi CZK 2026" rate for
-- consumer EU cards that applies after the introductory 0,47 % + 1 Kč (first 3 months / 1 000 000 Kč): 0,67 % + 1 Kč.
ALTER TABLE "Settings" ADD COLUMN "paymentFeeCardPercent" DECIMAL(6,3) NOT NULL DEFAULT 0.67;
ALTER TABLE "Settings" ADD COLUMN "paymentFeeCardFixed" DECIMAL(10,2) NOT NULL DEFAULT 1;
