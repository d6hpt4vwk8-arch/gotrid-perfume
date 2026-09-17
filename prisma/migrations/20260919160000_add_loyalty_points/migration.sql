CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST');

CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "orderId" TEXT,
    "points" INTEGER NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoyaltyTransaction_email_idx" ON "LoyaltyTransaction"("email");
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "pointsEarned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Settings" ADD COLUMN "loyaltyEarnPercent" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Settings" ADD COLUMN "loyaltyRedeemCapPercent" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Settings" ADD COLUMN "loyaltyMinOrderValue" DECIMAL(10,2) NOT NULL DEFAULT 300;
ALTER TABLE "Settings" ADD COLUMN "loyaltyExpiryMonths" INTEGER NOT NULL DEFAULT 12;
