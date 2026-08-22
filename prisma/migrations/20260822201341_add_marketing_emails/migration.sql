-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "secondOrderEmailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "secondOrderCouponCode" TEXT NOT NULL DEFAULT 'DRUHY10',
ADD COLUMN     "secondOrderDelayDays" INTEGER NOT NULL DEFAULT 14;

-- CreateTable
CREATE TABLE "NewsletterUnsubscribe" (
    "email" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterUnsubscribe_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "NewsletterCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);
