-- Standalone: Postgres can't use a new enum value in the same transaction
-- it was added in (same precedent as 20260903120000_add_gls_shipping_method).
ALTER TYPE "ShippingMethod" ADD VALUE 'GLS_MISTO';
