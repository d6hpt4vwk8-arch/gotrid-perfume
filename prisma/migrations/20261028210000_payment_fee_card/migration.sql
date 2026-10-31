-- AlterTable
-- Card-gateway (Comgate) fee used only in the net-profit figures: percent of the order total + a fixed amount per
-- transaction (Kč), one pair for Czech and one for Slovak orders. Defaults = Comgate Profi CZK 0,67 % + 1 Kč incl. 21 % VAT.
ALTER TABLE "Settings" ADD COLUMN "paymentFeeCardPercent" DECIMAL(6,3) NOT NULL DEFAULT 0.81;
ALTER TABLE "Settings" ADD COLUMN "paymentFeeCardFixed" DECIMAL(10,2) NOT NULL DEFAULT 1.21;
ALTER TABLE "Settings" ADD COLUMN "paymentFeeCardPercentSk" DECIMAL(6,3) NOT NULL DEFAULT 0.81;
ALTER TABLE "Settings" ADD COLUMN "paymentFeeCardFixedSk" DECIMAL(10,2) NOT NULL DEFAULT 1.21;
