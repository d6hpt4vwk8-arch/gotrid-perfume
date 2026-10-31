-- AlterEnum
ALTER TYPE "CouponType" ADD VALUE 'FREE_SHIPPING';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "ownerEmail" TEXT;
ALTER TABLE "Coupon" ADD COLUMN "giftProductId" TEXT;

-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameSk" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minOrderValue" DECIMAL(10,2),
    "giftProductId" TEXT,
    "validDays" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);
