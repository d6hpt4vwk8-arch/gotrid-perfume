-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "secondOrderCouponCode",
ADD COLUMN     "secondOrderDiscountPercent" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "secondOrderCouponPrefix" TEXT NOT NULL DEFAULT 'DRUHY';
