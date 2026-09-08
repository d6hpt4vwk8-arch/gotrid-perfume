-- Standalone: Postgres can't use a new enum value in the same transaction
-- it was added in, so this can't be combined with the migration that
-- drops Settings.giftThreshold (same precedent as 20260903120000_add_gls_shipping_method).
ALTER TYPE "CouponType" ADD VALUE 'GIFT';
