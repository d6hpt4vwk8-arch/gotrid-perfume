-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- Existing reviews were all entered directly by the admin (there was no
-- public submission path before this migration), so treat them as already
-- vetted rather than dropping them into the moderation queue.
UPDATE "Review" SET "published" = true;
