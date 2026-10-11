-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "instagramAccessToken" TEXT,
ADD COLUMN "instagramTokenSeed" TEXT,
ADD COLUMN "instagramTokenRefreshedAt" TIMESTAMP(3),
ADD COLUMN "instagramRefreshAlertAt" TIMESTAMP(3);
