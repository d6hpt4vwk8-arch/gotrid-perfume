-- The gift promo is now gated by applying a GIFT-type Coupon (with its own
-- optional minOrderValue) instead of a single global cart-total threshold.
ALTER TABLE "Settings" DROP COLUMN "giftThreshold";
