-- Shared "second order" coupon: per-e-mail eligibility instead of one random coupon per customer.
ALTER TABLE "Coupon" ADD COLUMN "secondOrderOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN "allowedEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Settings" ADD COLUMN "secondOrderValidDays" INTEGER NOT NULL DEFAULT 14;
